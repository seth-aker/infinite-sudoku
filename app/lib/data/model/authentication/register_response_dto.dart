import 'package:equatable/equatable.dart';
import 'package:infinite_sudoku/data/model/user/user_dto.dart';
import 'package:json_annotation/json_annotation.dart';

part 'register_response_dto.g.dart';
@JsonSerializable(createJsonSchema: true)
class RegisterResponseDto extends Equatable {
  final String accessToken;
  final String refreshToken;
  final UserDto user;

  const RegisterResponseDto({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    });

  Map<String, dynamic> toJson() => _$RegisterResponseDtoToJson(this);

  factory RegisterResponseDto.fromJson(Map<String, dynamic> json) => _$RegisterResponseDtoFromJson(json);

  static const jsonSchema = _$RegisterResponseDtoJsonSchema;

  @override
    List<Object?> get props => [accessToken, refreshToken, user];
}
