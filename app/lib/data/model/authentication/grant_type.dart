import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum GrantType {
  @JsonKey()
  password, 
  @JsonKey()
  refreshToken;
}
