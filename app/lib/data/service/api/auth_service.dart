import 'package:infinite_sudoku/data/model/authentication/login_request_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/login_response_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/refresh_token_response_dto.dart';
import 'package:infinite_sudoku/data/model/authentication/register_request_dto.dart';
import 'package:infinite_sudoku/data/model/user/user_dto.dart';
import 'package:infinite_sudoku/utils/result.dart';

abstract class AuthService {
  Future<Result<LoginResponseDto>> login(LoginRequestDto loginRequest);

  Future<Result<void>> logout();

  Future<Result<UserDto?>> register(RegisterRequestDto registerRequest);

  Future<Result<RefreshTokenResponseDto>> refreshAccessToken(String refreshToken);

  Future<Result<void>> requestResetLink(String email);
}
