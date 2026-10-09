import 'package:go_router/go_router.dart';
import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/core/widgets/form_checkbox.dart';
import 'package:infinite_sudoku/ui/core/widgets/form_text_input.dart';
import 'package:infinite_sudoku/ui/user/state/user_bloc.dart';
import 'package:infinite_sudoku/ui/user/validation/form_validators.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:toastification/toastification.dart';

class RegisterForm extends StatefulWidget {
  const RegisterForm({super.key});

  @override
  State<StatefulWidget> createState() => _RegisterFormState();
}

class _RegisterFormState extends State<RegisterForm> {
  final _formKey = GlobalKey<FormState>();
  String _email = '';
  String _username = '';
  String _password = '';
  String _confirmPassword = '';
  bool _termsAndCondsChecked = false;
  @override
  Widget build(BuildContext context) {
    return BlocConsumer<UserBloc, UserState>(
      listener: (context, state) {
        if (state.status == .authenticated) {
          toastification.show(
            title: Text("Welcome $_username!"),
            description: const Text(
              "Please check your email for a link to verify your account",
            ),
            type: .success,
            autoCloseDuration: const Duration(seconds: 3),
          );
          context.go(Routes.home);
        }
        if (state.status == .error) {
          toastification.show(
            title: Text(state.statusMessage ?? "An error occured"),
            type: .error,
            autoCloseDuration: const Duration(seconds: 3),
          );
        }
      },
      listenWhen: (previous, current) => previous.status != current.status,
      builder: (context, state) {
        final loading = state.status == .loading;
        return Form(
          key: _formKey,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: FormTextInput(
                  label: "Email",
                  validator: (value) => validateEmail(value),
                  onChanged: (value) => _email = value,
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: FormTextInput(
                  label: "Username",
                  validator: (value) => validateUsername(value),
                  onChanged: (value) => _username = value,
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: FormTextInput(
                  label: "Password",
                  obscureText: true,
                  validator: (value) => validatePassword(value),
                  onChanged: (value) => _password = value,
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: FormTextInput(
                  label: "Confirm Password",
                  obscureText: true,
                  validator: (_) {
                    if (_confirmPassword != _password) {
                      return "Doesn't match password field";
                    }
                    return null;
                  },
                  onChanged: (value) => _confirmPassword = value,
                ),
              ),
              Padding(
                padding: const .all(AppSpacing.half),
                child: FormCheckbox(
                  initialValue: false,
                  validator: (_) {
                    if (!_termsAndCondsChecked) {
                      return 'Please accept the terms and conditions';
                    }
                    return null;
                  },
                  onChanged: (value) => _termsAndCondsChecked = value ?? false,
                  trailing: Padding(
                    padding: .directional(start: AppSpacing.quarter),
                    child: const Text("Accept Terms and Conditions?", style: TextStyle(fontSize: AppSpacing.sevenEighths),),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: Button.primary(
                  isDisabled: loading,
                  padding: const EdgeInsetsGeometry.directional(
                    top: AppSpacing.half,
                    bottom: AppSpacing.half,
                    start: AppSpacing.two,
                    end: AppSpacing.two,
                  ),
                  child: loading
                      ? const CupertinoActivityIndicator()
                      : const Text('Register'),
                  onPressed: () {
                    final isValid = _formKey.currentState?.validate();
                    if (isValid == null || isValid == false) {
                      return;
                    }
                    context.read<UserBloc>().add(
                      RegisterRequested(
                        email: _email,
                        password: _password,
                        username: _username,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
