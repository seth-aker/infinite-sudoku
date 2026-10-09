import 'package:equatable/equatable.dart';
import 'package:json_annotation/json_annotation.dart';

part 'register_request_dto.g.dart';

@JsonSerializable(createJsonSchema: true, createFactory: false)
class RegisterRequestDto extends Equatable {
  final String email;
  final String username;
  final String password;
  final bool tosAcknowledged;
  const RegisterRequestDto({
    required this.email,
    required this.password,
    required this.username,
    this.tosAcknowledged = false,
  });

  Map<String, dynamic> toJson() {
    return _$RegisterRequestDtoToJson(this);
  }

  static const jsonSchema = _$RegisterRequestDtoJsonSchema;

  @override
  List<Object?> get props => [email, password, username, tosAcknowledged];
}
