import 'package:infinite_sudoku/data/model/authentication/grant_type.dart';
import 'package:equatable/equatable.dart';
import 'package:json_annotation/json_annotation.dart';

part 'login_request_dto.g.dart';

@JsonSerializable(
  createJsonSchema: true, 
  createFactory: false,
  ignoreUnannotated: true,
)
class LoginRequestDto extends Equatable {
  @JsonKey()
  final String email;
  @JsonKey()
  final String password;
  @JsonKey()
  final GrantType grantType;

  const LoginRequestDto({
    required this.email,
    required this.password,
    required this.grantType
  });

  Map<String, dynamic> toJson() =>
    _$LoginRequestDtoToJson(this);

  static const jsonSchema = _$LoginRequestDtoJsonSchema;

  @override
  List<Object?> get props => [email, password, grantType];
}
