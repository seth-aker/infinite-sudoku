import 'package:sudoku_app/data/repositories/auth_repository.dart';
import 'package:sudoku_app/domain/models/user.dart';
import 'package:sudoku_app/utils/logger/logger.dart';
import 'package:hydrated_bloc/hydrated_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:sudoku_app/utils/result.dart';
part 'user_event.dart';
part 'user_state.dart';

class UserBloc extends HydratedBloc<UserEvent, UserState> {
  final AuthRepository _authRepository;
  UserBloc({required this._authRepository})
    : super(const UserState.initial()) {
    on<LoginRequested>(_onLoginRequested);
    on<RegisterRequested>(_onRegisterRequested);
    on<LogoutRequested>(_onLogoutRequested);
    on<PasswordResetEmailRequested>(_onPasswordResetRequested);
  }

  Future<void> _onLoginRequested(
    LoginRequested event,
    Emitter<UserState> emit,
  ) async {
    emit(state.loading());
    final username = event.email;
    final password = event.password;

    final result = await _authRepository.login(username, password);
    switch (result) {
      case Error<User>():
        final message = result.error.toString();
        emit(state.error(message));
      case Ok<User>():
        final user = result.value;
        emit(
          UserState.authenticated(
	    user: user,
          ),
        );
    }
  }

  Future<void> _onRegisterRequested(
    RegisterRequested event,
    Emitter<UserState> emit,
  ) async {
    emit(state.loading());
    final email = event.email;
    final password = event.password;
    final username = event.username;
    final result = await _authRepository.register(email, username, password);

    switch (result) {
      case Error<User?>():
        emit(state.error(result.error.toString()));
        return;
      case Ok<User?>():
        final user = result.value;
        if (user == null) {
          emit(state.error("Registrasion failed, please try again."));
          return;
        }
        emit(
          UserState.authenticated(
	    user: user,
          ),
        );
    }
  }

  Future<void> _onLogoutRequested(
    LogoutRequested event,
    Emitter<UserState> emit,
  ) async {
    emit(state.loading());

    final result = await _authRepository.logout();

    switch (result) {
      case Error<void>():
        emit(state.error(result.error.toString()));
        return;
      case Ok<void>():
        emit(UserState.unauthenticated());
        return;
    }
  }

  Future<void> _onPasswordResetRequested(
    PasswordResetEmailRequested event,
    Emitter<UserState> emit,
  ) async {
    if(state.status != .authenticated) return;
    emit(state.loading());
    final result = await _authRepository.requestResetLink(event.email);

    switch (result) {
      case Error():
	emit(state.error(result.error.toString()));
        return;
      case Ok():
        emit(state.copyWith());
    }
  }

  @override
  UserState? fromJson(Map<String, dynamic> json) {
    try {
      final status = json['status'];
      switch (status) {
        case 'authenticated':
          return UserState.authenticated(
	    user: User.fromJson(json['user'])          );
        case 'loading':
          return UserState._(status: .loading);
	case 'error':
	  return UserState._(status: .error, statusMessage: json['statusMessage']);
        default:
          return UserState.unauthenticated();
      }
    } catch (e) {
      logger.e(e);
      return UserState._(status: .error, statusMessage: "An error occured retrieving saved user state.");
    }
  }

  @override
  Map<String, dynamic>? toJson(UserState state) {
    try {
	return {
	  'status': state.status.name,
	  'user': state.user?.toJson(),
	  'statusMessage': state.statusMessage,
	};
      }
     catch (e) {
      logger.e(e);
      return null;
    }
  }
}
