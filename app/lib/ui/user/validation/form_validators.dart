import 'package:sudoku_app/domain/validation/user_validators.dart';
String? validateUsername(String? value) {
  final error = UserValidator.username(value);
  if(error != null) {
    switch(error.errorType) {
      case .tooShort: 
	return "Username must be more than 3 characters";
      case .tooLong:
	return "Username cannot be more that 30 characters";
      case.isBlank:
	return "Username cannot be blank";
      case .inUse:
	return "Username already taken";
      case .invalidChars:
	return "Username can only include letters, numbers, dots, dashes, and underscores";
    }
  }
  return null;
}

String? validateEmail(String? value) {
  final error = UserValidator.email(value);
  if(error != null) {
    switch(error.errorType) {
      case .isBlank:
	return "Email cannot be blank";
      case .inUse:
	return "Email is already in use";
     default:
	return "Email is invalid";
    }
  }
  return null;
}

String? validatePassword(String? value) {
  final error = UserValidator.password(value);
  if(error != null) {
    switch(error.errorType) {
      case .tooShort:
	return "Password must be at least 8 characters";
      case .tooLong:
	return "Password cannot be more than 64 characters";
      case .isBlank:
	return "Password cannot be blank";
      default:
	return "Password is invalid";
    }
  }
  return null;
}
