import 'dart:convert' show jsonDecode, jsonEncode, utf8;
import 'dart:io';

import 'package:infinite_sudoku/utils/logger/logger.dart';
import 'package:infinite_sudoku/utils/result.dart';

typedef AuthHeaderProvider = String? Function();
typedef AuthRefreshFunction = Future<Result<void>> Function();

class ApiException implements Exception {
  ApiException(this.statusCode, this.message);
  final int statusCode;
  final String? message;
}

class ApiClient {
  final String _host;
  final int _port;
  final HttpClient Function() _clientFactory;
  Future<Result<void>>? _refreshPromise;
  AuthHeaderProvider? authHeaderProvider;
  AuthRefreshFunction? _authRefreshFunction;

  ApiClient({
    this._host = '127.0.0.1',
    this._port = 3666,
    this._clientFactory = HttpClient.new,
  });

  Future<Result<T>> send<T>(
    String method,
    String path, {
    Object? body,
    int expectedStatus = 200,
    required T Function(dynamic json) parse,
    bool isRetry = false,
  }) async {
    final client = _clientFactory();
    try {
      final request = await client.open(method, _host, _port, path);

      final authHeader = authHeaderProvider?.call();
      if (authHeader != null) {
        request.headers.add(HttpHeaders.authorizationHeader, authHeader);
      }
      request.headers.contentType = ContentType.json;

      if (body != null) {
        request.write(jsonEncode(body));
      }

      final response = await request.close();

      if (response.statusCode == 401 && !isRetry) {
        if (_refreshPromise == null && _authRefreshFunction != null) {
          _refreshPromise = _authRefreshFunction!().whenComplete(
            () => _refreshPromise = null,
          );
        }
        final refreshResult = await _refreshPromise;
        switch (refreshResult) {
          case Error():
          case null:
            throw ApiException(401, "Session expired, please log in again.");
          case Ok():
            return await send(
              method,
              path,
              body: body,
              expectedStatus: expectedStatus,
              parse: parse,
              isRetry: true,
            );
        }
      }

      if (response.statusCode != expectedStatus) {
        logger.e("Error with response status code: ${response.statusCode}");
        return Result.error(
          HttpException('Invalid response code: ${response.statusCode}'),
        );
      }

      final stringData = await response.transform(utf8.decoder).join();
      logger.t("Raw data recieved: $stringData");
      final json = stringData.isEmpty ? null : jsonDecode(stringData);
      logger.t("Json data: $json");
      return Result.ok(parse(json));
    } on Exception catch (err) {
      logger.e(err);
      return Result.error(err);
    } finally {
      client.close();
    }
  }
}
