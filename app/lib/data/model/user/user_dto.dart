import 'package:equatable/equatable.dart';
import 'package:json_annotation/json_annotation.dart';

part 'user_dto.g.dart';

@JsonSerializable(createJsonSchema: true)
class UserDto extends Equatable {
  final String id;
  final String email;
  final bool emailVerified;
  final String username;
  final String role;
  final String? imageUrl;
  final String? currentPuzzleId;

  const UserDto({
    required this.id,
    required this.email,
    required this.username,
    required this.role,
    this.emailVerified = false,
    this.imageUrl,
    this.currentPuzzleId,
  });

  factory UserDto.fromJson(Map<String, dynamic> json) =>
      _$UserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UserDtoToJson(this);

  static const jsonSchema = _$UserDtoJsonSchema;

  @override
  List<Object?> get props => [
    id,
    email,
    username,
    role,
    emailVerified,
    imageUrl,
    currentPuzzleId,
  ];
}

@JsonSerializable(createJsonSchema: true, createFactory: false)
class CreateUserDto extends Equatable {
  final String email;
  final String username;
  final String password;
  final bool tosAcknowledged;
  const CreateUserDto({
    required this.email,
    required this.username,
    required this.password,
    this.tosAcknowledged = false,
  });
  Map<String, dynamic> toJson() => _$CreateUserDtoToJson(this);

  static const jsonSchema = _$CreateUserDtoJsonSchema;
  @override
  List<Object?> get props => [username, password, email, tosAcknowledged];
}
