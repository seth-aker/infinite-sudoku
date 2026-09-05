part of 'user_bloc.dart';

enum UserStatus { loading, authenticated, unauthenticated, error }

final class UserState extends Equatable {
  final UserStatus status;
  final User? user;
  final String? statusMessage;

  const UserState._({
    this.status = .unauthenticated,
    this.user,
    this.statusMessage,
  });
  const factory UserState.initial() = UserState._;

  factory UserState.unauthenticated({String? statusMessage}) => UserState._(
    status: .unauthenticated,
    user: null,
    statusMessage: statusMessage,
  );

  factory UserState.authenticated({
    required User user,
    String? statusMessage,
  }) => UserState._(
    status: .authenticated,
    user: user,
    statusMessage: statusMessage,
  );
  
  UserState loading() => copyWith(status: .loading);

  UserState error(String? errorMessage) =>
    copyWith(status: .error, statusMessage: errorMessage ?? statusMessage);

  UserState copyWith({
    String? email,
    String? username,
    String? currentPuzzleId,
    String? imageUrl,
    UserStatus? status,
    String? statusMessage,
  }) => UserState._(
    status: status ?? this.status,
    statusMessage: statusMessage ?? this.statusMessage,
    user: user?.copyWith(
      email: email,
      username: username,
      currentPuzzleId: currentPuzzleId,
      imageUrl: imageUrl,
    ),
  );
  @override
  List<Object?> get props => [status, user, statusMessage];
}
