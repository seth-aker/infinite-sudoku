import 'package:sudoku_app/utils/result.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorageService {
  final FlutterSecureStorage _storageClient;
  const TokenStorageService({required this._storageClient});
  
  Future<Result<void>> saveToken(String refreshToken) async {
    try {
      await _storageClient.write(key: 'refreshToken', value: refreshToken);
      return Result.ok(null);
    } on Exception catch (err) {
      return Result.error(err);
    }
  }

  Future<Result<void>> clear() async {
    try {
      await _storageClient.delete(key: 'refreshToken');
      return Result.ok(null);
    } on Exception catch (error) {
      return Result.error(error);
    }
  }

  Future<Result<String>> getToken() async {
    try {
      final response = await _storageClient.read(key: 'refreshToken');
      if(response == null) {
	return Result.error(Exception('No refresh token found'));
      }
      return Result.ok(response);
    } on Exception catch (error) {
      return Result.error(error);
    }
  }
} 
