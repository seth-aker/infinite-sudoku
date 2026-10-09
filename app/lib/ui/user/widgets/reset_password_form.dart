import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_sudoku/data/repositories/auth_repository.dart';
import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/core/widgets/form_text_input.dart';
import 'package:infinite_sudoku/ui/user/validation/form_validators.dart';
import 'package:infinite_sudoku/utils/result.dart';
import 'package:toastification/toastification.dart';

class ResetPasswordForm extends StatefulWidget {
  final String token;
  const ResetPasswordForm({required this.token, super.key});

  @override
  State<StatefulWidget> createState() => _ResetPasswordFormState();
}

class _ResetPasswordFormState extends State<ResetPasswordForm> {
  final _formKey = GlobalKey<FormState>();
  String _password = '';
  String _confirmPassword = '';
  bool _loading = false;
  Future<void> _submit() async {
    final isValid = _formKey.currentState?.validate();
    if (isValid == false) {
      return;
    }
    setState(() {
      _loading = true;
    });
    final result = await context.read<AuthRepository>().resetPassword(
      _password,
      widget.token,
    );

    if (!mounted) return;
    switch (result) {
      case Ok():
        toastification.show(
          type: .success,
          title: const Text("Success"),
          description: const Text('Password sucessfully reset'),
          autoCloseDuration: const Duration(seconds: 3),
        );
        context.goNamed(Routes.home);
        return;
      case Error():
        setState(() {
          _loading = false;
        });
        toastification.show(
          type: .error,
          title: const Text("Oops!"),
          description: Text(result.error.toString()),
          autoCloseDuration: const Duration(seconds: 3),
        );
        return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Form(
          key: _formKey,
          child: Column(
            children: [
              Padding(
                padding: const .all(AppSpacing.half),
                child: FormTextInput(
                  label: "Password",
                  obscureText: true,
                  onChanged: (value) => _password = value,
                  validator: (value) => validatePassword(value),
                ),
              ),
              Padding(
                padding: const .all(AppSpacing.half),
                child: FormTextInput(
                  label: "Confirm Password",
                  obscureText: true,
                  onChanged: (value) => _confirmPassword = value,
                  validator: (_) {
                    if (_password != _confirmPassword) {
                      return "Doesn't match password field.";
                    }
                    return null;
                  },
                ),
              ),
              Padding(
                padding: const .all(AppSpacing.half),
                child: Button.primary(
                  isDisabled: _loading,
                  padding: const .directional(
                    top: AppSpacing.half,
                    bottom: AppSpacing.half,
                    start: AppSpacing.two,
                    end: AppSpacing.two,
                  ),
                  onPressed: _submit,
                  child: _loading
                      ? const CupertinoActivityIndicator()
                      : const Text('Reset Password'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
