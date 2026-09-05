part of 'user_bloc.dart';

sealed class UserEvent extends Equatable {
  const UserEvent();

  @override
  List<Object?> get props;
}

class LoginRequested extends UserEvent {
  final String email;
  final String password;

  const LoginRequested({required this.email, required this.password});

  @override
  List<Object?> get props => [email, password];
}

class LogoutRequested extends UserEvent {
  const LogoutRequested();

  @override
  List<Object?> get props => [];
}

class RegisterRequested extends UserEvent {
  final String password;
  final String email;
  final String username;
  const RegisterRequested({
    required this.password,
    required this.email,
    required this.username,
  });

  @override
  List<Object?> get props => [username, password, email];
}

class PasswordResetEmailRequested extends UserEvent {
  final String email;
  const PasswordResetEmailRequested({required this.email});
  @override
  List<Object?> get props => [email];
}
