import 'package:infinite_sudoku/data/model/authentication/login_request_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/login_response_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/refresh_token_response_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/register_request_dto.dart';
import 'package:infinite_sudoku/data/model/user/user_dto.dart';
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
        '/api/auth/token',
        body: loginRequest.toJson(),
        parse: (json) => LoginResponseDto.fromJson(json),
      );

  @override
  Future<Result<void>> logout() => _client.send(
    'POST',
    '/api/auth/logout',
    expectedStatus: 204,
    parse: (_) {},
  );

  @override
  Future<Result<UserDto?>> register(RegisterRequestDto registerRequest) =>
      _client.send(
        'POST',
        '/api/auth/register',
        body: registerRequest.toJson(),
        expectedStatus: 201,
        parse: (json) => UserDto.fromJson(json),
      );

  @override
  Future<Result<RefreshTokenResponseDto>> refreshAccessToken(
    String refreshToken,
  ) => _client.send(
    'POST',
    '/api/auth/token',
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
}
