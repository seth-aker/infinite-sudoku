import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/core/widgets/form_text_input.dart';
import 'package:infinite_sudoku/ui/user/state/user_bloc.dart';
import 'package:infinite_sudoku/ui/user/validation/form_validators.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:toastification/toastification.dart';

class LoginForm extends StatefulWidget {
  const LoginForm({super.key});

  @override
  State<StatefulWidget> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _formKey = GlobalKey<FormState>();

  final _email = TextEditingController();

  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<UserBloc, UserState>(
      listener: ((context, state) {
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
      }),
      builder: (context, state) {
        final loading = state.status == .loading;
        final submitDisabled =
            loading; // TODO: extend this to depend on fixing validation after a failed submit
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
                  obscureText: true,
                  label: "Password",
                  controller: _password,
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
                      LoginRequested(
                        email: _email.text,
                        password: _password.text,
                      ),
                    );
                  },
                  child: loading
                      ? const CupertinoActivityIndicator()
                      : const Text('Login'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
