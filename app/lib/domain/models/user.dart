import 'package:sudoku_app/data/model/user/user_dto.dart';
import 'package:json_annotation/json_annotation.dart';
part 'user.g.dart';
enum UserRole {
  user,
  admin;

  factory UserRole.fromString(String str) {
    switch (str) {
      case 'user':
        return user;
      case 'admin':
        return admin;
      default:
        return user;
    }
  }
}
@JsonSerializable()
class User {
  final String userId;

  final String email;

  final String username;

  final UserRole role;

  final String? imageUrl;

  final String? currentPuzzleId;

  const User({
    required this.userId,
    required this.email,
    required this.username,
    required this.role,
    this.imageUrl,
    this.currentPuzzleId,
  });

  User copyWith({
    String? email,
    String? username,
    UserRole? role,
    String? imageUrl,
    String? currentPuzzleId,
  }) => User(
    userId: userId,
    email: email ?? this.email,
    username: username ?? this.username,
    role: role ?? this.role,
    imageUrl: imageUrl ?? this.imageUrl,
    currentPuzzleId: currentPuzzleId ?? this.currentPuzzleId,
  );
  factory User.fromDto(UserDto dto) {
    return User(
      userId: dto.id,
      email: dto.email,
      username: dto.username,
      role: UserRole.fromString(dto.role),
      imageUrl: dto.imageUrl,
      currentPuzzleId: dto.currentPuzzleId,
    );
  }

  UserDto toDto() {
    return UserDto(
      id: userId,
      username: username,
      email: email,
      role: role.name,
      imageUrl: imageUrl,
      currentPuzzleId: currentPuzzleId,
    );
  }
  
  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);

  Map<String, dynamic> toJson() => _$UserToJson(this);
 
}
