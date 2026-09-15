import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_sudoku/data/repositories/auth_repository.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/text_input.dart';
import 'package:infinite_sudoku/ui/user/validation/form_validators.dart';
import 'package:infinite_sudoku/utils/result.dart';
import 'package:toastification/toastification.dart';

void showResetPasswordDialog<T>(BuildContext context) async {
  showCupertinoDialog<T>(
    context: context,
    builder: ((context) {
      return _ResetPasswordDialog();
    }),
  );
}

class _ResetPasswordDialog extends StatefulWidget {
  @override
  State<StatefulWidget> createState() {
    return _ResetPasswordDialogState();
  }
}

class _ResetPasswordDialogState extends State<_ResetPasswordDialog> {
  String _email = '';
  String? _error;
  bool _sending = false;

  Future<void> _submit() async {
    final validationError = validateEmail(_email);
    if (validationError != null) {
      setState(() {
        _error = validationError;
      });
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    final result = await context.read<AuthRepository>().requestResetLink(
      _email,
    );
    if (!mounted) return;
    switch (result) {
      case Ok():
        toastification.show(
          type: .success,
          title: const Text("Success"),
          description: const Text(
            "A password reset link will be sent if the email entered exists.",
          ),
          autoCloseDuration: const Duration(seconds: 3),
        );
        context.pop();
      case Error():
        setState(() {
          _sending = false;
          _error = result.error.toString();
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoAlertDialog(
      title: Padding(
        padding: .directional(bottom: AppSpacing.one),
        child: Text("Please enter your email"),
      ),
      content: Column(
	crossAxisAlignment: .start,
        children: [
          TextInput(
            onChanged: (value) => _email = value,
            placeholder: "your@email.com",
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            autofillHints: const [AutofillHints.email],
            errorText: _error,
          ),
	  if(_error != null) Padding(
	    padding: const EdgeInsets.all(AppSpacing.quarter),
	    child: Text(_error!, style: TextStyle(color: AppTheme.destructive()),),
	  ),
        ],
      ),

      actions: [
        CupertinoDialogAction(
          onPressed: _sending ? null : () => context.pop(),
          child: const Text("Cancel"),
        ),
        CupertinoDialogAction(
          isDefaultAction: true,
          onPressed: _sending ? null : _submit,
          child: _sending
              ? const CupertinoActivityIndicator()
              : const Text("Send Link"),
        ),
      ],
    );
  }
}
