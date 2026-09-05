import 'package:sudoku_app/data/model/user/user_dto.dart';
import 'package:equatable/equatable.dart';
import 'package:json_annotation/json_annotation.dart';

part 'login_response_dto.g.dart';

@JsonSerializable(createJsonSchema: true, createToJson: false)
class LoginResponseDto extends Equatable {
  final String accessToken;
  final String refreshToken;
  final UserDto user;

  const LoginResponseDto({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory LoginResponseDto.fromJson(Map<String, dynamic> json) =>
      _$LoginResponseDtoFromJson(json);

  static const jsonSchema = _$LoginResponseDtoJsonSchema;

  @override
  List<Object?> get props => [accessToken, refreshToken, user];
}
