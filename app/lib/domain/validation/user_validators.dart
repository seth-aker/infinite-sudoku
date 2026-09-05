import 'package:sudoku_app/domain/validation/validation_errors.dart';

class UserValidator {
  static final RegExp _usernameRegex = RegExp(r'^[a-zA-Z0-9_-]{4,30}$');
  static final RegExp _emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
  static UsernameError? username(String? value) {
    if(value == null || value.trim().isEmpty) {
      return UsernameError(errorType: .isBlank);
    }
    if(value.length < 3) {
      return UsernameError(errorType: .tooShort);
    }
    if(value.length >= 30) {
      return UsernameError(errorType: .tooLong);
    }
    if(!_usernameRegex.hasMatch(value)) {
      return UsernameError(errorType: .invalidChars);
    }
    return null;
  }

  static PasswordError? password(String? value) {
    if(value == null || value.trim().isEmpty) {
      return PasswordError(errorType: .isBlank);
    }
    if(value.length < 8) {
      return PasswordError(errorType: .tooShort);
    }
    if(value.length >= 64) {
      return PasswordError(errorType: .tooLong);
    }
    return null;
  }
  static EmailError? email(String? value) {
    if(value == null || value.trim().isEmpty) {
      return EmailError(errorType: .isBlank);
    }
    if(!_emailRegex.hasMatch(value)) {
      return EmailError(errorType: .invalidChars);
    }
    return null;
  }
}
