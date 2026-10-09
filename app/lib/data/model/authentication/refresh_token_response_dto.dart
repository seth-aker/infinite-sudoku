import 'package:equatable/equatable.dart';
import 'package:json_annotation/json_annotation.dart';

part 'refresh_token_response_dto.g.dart'; 

@JsonSerializable(createJsonSchema: true, createToJson: false)
class RefreshTokenResponseDto extends Equatable {
  final String accessToken;
  final String refreshToken;

  const RefreshTokenResponseDto({
    required this.accessToken,
    required this.refreshToken,
  });

  factory RefreshTokenResponseDto.fromJson(Map<String, dynamic> json) => 
    _$RefreshTokenResponseDtoFromJson(json);

  static const jsonSchema = _$RefreshTokenResponseDtoJsonSchema;
  @override
  List<Object?> get props => [accessToken, refreshToken];
}