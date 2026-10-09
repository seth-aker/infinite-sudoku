abstract class ValidationError {
  final ValidationErrorType errorType;
  const ValidationError({required this.errorType});
}
enum ValidationErrorType {
  tooShort,
  tooLong,
  inUse,
  isBlank,
  invalidChars,
}
class PasswordError extends ValidationError {
  const PasswordError({required super.errorType});
}


class UsernameError extends ValidationError {
  const UsernameError({required super.errorType});
}

class EmailError extends ValidationError {
  const EmailError({required super.errorType});
}

