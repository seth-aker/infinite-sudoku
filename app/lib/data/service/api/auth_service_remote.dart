import 'package:infinite_sudoku/data/model/authentication/login_request_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/login_response_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/refresh_token_response_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/register_request_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/register_response_dto.dart';
import 'package:infinite_sudoku/data/service/api/api_client.dart';
import 'package:infinite_sudoku/data/service/api/auth_service.dart';
import 'package:infinite_sudoku/utils/result.dart';

class AuthServiceRemote implements AuthService {
  AuthServiceRemote({required this._client});

  final ApiClient _client;

  @override
  Future<Result<LoginResponseDto>> login(LoginRequestDto loginRequest) =>
      _client.send(
        'POST',
        '/api/auth/mobile/login',
        body: loginRequest.toJson(),
        parse: (json) => LoginResponseDto.fromJson(json),
      );

  @override
  Future<Result<void>> logout() => _client.send(
    'POST',
    '/api/auth/mobile/logout',
    expectedStatus: 204,
    parse: (_) {},
  );

  @override
  Future<Result<RegisterResponseDto>> register(
    RegisterRequestDto registerRequest,
  ) => _client.send(
    'POST',
    '/api/auth/mobile/register',
    body: registerRequest.toJson(),
    expectedStatus: 201,
    parse: (json) => RegisterResponseDto.fromJson(json),
  );

  @override
  Future<Result<RefreshTokenResponseDto>> refreshAccessToken(
    String refreshToken,
  ) => _client.send(
    'POST',
    '/api/auth/mobile/refresh',
    body: {'refreshToken': refreshToken, 'grantType': 'refreshToken'},
    parse: (json) => RefreshTokenResponseDto.fromJson(json),
  );

  @override
  Future<Result<void>> requestResetLink(String email) => _client.send(
    'POST',
    '/api/auth/requestResetPassword',
    parse: (_) {},
    body: {"email": email},
    expectedStatus: 204,
  );

  @override
  Future<Result<void>> resetPassword(String password, String token) =>
      _client.send(
        'POST',
        '/api/auth/resetPassword',
        parse: (_) {},
        body: {'password': password, 'token': token},
        expectedStatus: 200,
      );
}
