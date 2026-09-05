import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:sudoku_app/ui/core/widgets/button.dart';
import 'package:sudoku_app/ui/core/widgets/form_text_input.dart';
import 'package:sudoku_app/ui/user/state/user_bloc.dart';
import 'package:sudoku_app/ui/user/validation/form_validators.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class RegisterForm extends StatefulWidget {
  const RegisterForm({super.key});

  @override
  State<StatefulWidget> createState() => _RegisterFormState();
}

class _RegisterFormState extends State<RegisterForm> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _username.dispose();
    _password.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.half),
            child: FormTextInput(
              label: "Email",
              controller: _email,
              validator: (value) => validateEmail(value),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.half),
            child: FormTextInput(
              label: "Username",
              controller: _username,
              validator: (value) => validateUsername(value),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.half),
            child: FormTextInput(
              label: "Password",
              controller: _password,
              obscureText: true,
              validator: (value) => validatePassword(value),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.half),
            child: FormTextInput(
              label: "Confirm Password",
              controller: _confirmPassword,
              obscureText: true,
              validator: (value) {
                if (value != _password.text) {
                  return "Doesn't match password field";
                }
                return null;
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.half),
            child: Button.primary(
              padding: const EdgeInsetsGeometry.directional(
                top: AppSpacing.half,
                bottom: AppSpacing.half,
                start: AppSpacing.two,
                end: AppSpacing.two,
              ),
              child: const Text('Register'),
              onPressed: () {
                final isValid = _formKey.currentState?.validate();
                if (isValid == null || isValid == false) {
                  return;
                }
                context.read<UserBloc>().add(
                  RegisterRequested(
                    email: _email.text,
                    password: _password.text,
                    username: _username.text,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
