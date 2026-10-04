import 'package:infinite_sudoku/utils/logger/logger.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorageService {
  final FlutterSecureStorage _storageClient;
  const TokenStorageService({required this._storageClient});

  Future<void> saveToken(String refreshToken) async {
    try {
      await _storageClient.write(key: 'refreshToken', value: refreshToken);
      return;
    } on Exception catch (err) {
      logger.e('Error saving refreshToken', error: err);
      return;
    }
  }

  Future<void> clear() async {
    try {
      return await _storageClient.delete(key: 'refreshToken');
    } on Exception catch (error) {
      logger.e('Error clearing token', error: error);
      return;
    }
  }

  Future<String?> getToken() async {
    try {
      return await _storageClient.read(key: 'refreshToken');
    } on Exception catch (error) {
      logger.e('Error reading token', error: error);
      return null;
    }
  }
}
