import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/core/widgets/form_text_input.dart';
import 'package:infinite_sudoku/ui/user/state/user_bloc.dart';
import 'package:infinite_sudoku/ui/user/validation/form_validators.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_sudoku/ui/user/widgets/reset_password_dialog.dart';
import 'package:toastification/toastification.dart';

class LoginForm extends StatefulWidget {
  const LoginForm({super.key});

  @override
  State<StatefulWidget> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _formKey = GlobalKey<FormState>();

  String _email = '';
  String _password = '';

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<UserBloc, UserState>(
      listener: (context, state) {
        if (state.status == .authenticated) {
          toastification.show(
            title: Text("Login success!"),
            description: Text('Welcome back, ${state.user!.username}'),
            autoCloseDuration: const Duration(seconds: 3),
          );
          context.go(Routes.home);
        } else if (state.status == .error) {
          toastification.show(
            type: .error,
            title: Text(state.statusMessage ?? "An error occurred"),
            autoCloseDuration: const Duration(seconds: 3),
          );
        }
      },
      builder: (context, state) {
        final loading = state.status == .loading;
        final submitDisabled =
            loading; // TODO: extend this to depend on fixing validation after a failed submit
        return Column(
          children: [
            Form(
              key: _formKey,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.half),
                    child: FormTextInput(
                      label: "Email",
                      onChanged: (value) => _email = value,
                      validator: (value) => validateEmail(value),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.half,
                      AppSpacing.half,
                      AppSpacing.half,
                      0,
                    ),
                    child: FormTextInput(
                      obscureText: true,
                      label: "Password",
                      onChanged: (value) => _password = value,
                      validator: (value) => validatePassword(value),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.half,
                      0,
                      0,
                      AppSpacing.half,
                    ),
                    child: Align(
                      alignment: .topLeft,
                      child: Button.ghost(
                        padding: .all(AppSpacing.sixteenth),
                        onPressed: () => showResetPasswordDialog(context),
                        child: const Text(
                          "Forgot Password?",
                          style: TextStyle(fontSize: AppSpacing.sevenEighths),
                        ),
                      ),
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
                      isDisabled: submitDisabled,
                      onPressed: () {
                        final isValid = _formKey.currentState?.validate();
                        if (isValid == null || isValid == false) {
                          return;
                        }
                        context.read<UserBloc>().add(
                          LoginRequested(email: _email, password: _password),
                        );
                      },
                      child: loading
                          ? const CupertinoActivityIndicator()
                          : const Text('Login'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
