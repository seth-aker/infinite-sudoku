import 'package:infinite_sudoku/data/model/authentication/grant_type.dart';
import 'package:infinite_sudoku/data/model/authentication/login_request_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/register_request_dto.dart';
import 'package:infinite_sudoku/data/service/api/auth_service.dart';
import 'package:infinite_sudoku/data/service/local_storage/token_storage_service.dart';
import 'package:infinite_sudoku/domain/models/user.dart';
import 'package:infinite_sudoku/utils/result.dart';

class AuthRepository {
  final AuthService _authService;
  final TokenStorageService _storageService;

  String? _accessToken;

  AuthRepository({required this._authService, required this._storageService});

  String? get authHeader =>
      _accessToken != null ? 'Bearer $_accessToken' : null;

  Future<Result<User>> login(String email, String password) async {
    final request = LoginRequestDto(
      email: email,
      password: password,
      grantType: GrantType.password,
    );
    final response = await _authService.login(request);
    switch (response) {
      case Error():
        {
          return Error(response.error);
        }
      case Ok():
        {
          _accessToken = response.value.accessToken;
          await _storageService.saveToken(response.value.refreshToken);
          return Result.ok(User.fromDto(response.value.user));
        }
    }
  }

  Future<Result<void>> logout() async {
    _accessToken = null;
    await _storageService.clear();
    return await _authService.logout();
  }

  Future<Result<User?>> register(
    String email,
    String username,
    String password,
  ) async {
    final result = await _authService.register(
      RegisterRequestDto(
        email: email,
        username: username,
        password: password,
        // Validation guards prevent the AuthRepository from being called if Terms of Service isn't acknowledged.
        tosAcknowledged: true,
      ),
    );
    switch (result) {
      case Ok():
        final userDto = result.value;
        return Result.ok(userDto != null ? User.fromDto(userDto) : null);
      case Error():
        return Result.error(result.error);
    }
  }

  Future<Result<void>> refreshAccessToken() async {
    final refreshToken = await _storageService.getToken();
    switch (refreshToken) {
      case Error():
        return Result.error(refreshToken.error);
      case Ok():
        final result = await _authService.refreshAccessToken(
          refreshToken.value,
        );
        switch (result) {
          case Error():
            return Result.error(result.error);
          case Ok():
            _accessToken = result.value.accessToken;
            await _storageService.saveToken(result.value.refreshToken);
            return Result.ok(null);
        }
    }
  }
  Future<Result<void>> requestResetLink(String email) async {
    final result = await _authService.requestResetLink(email);
    switch (result) {
      case Error():
	return result;
      case Ok():
	return result;
    }
  }
}
