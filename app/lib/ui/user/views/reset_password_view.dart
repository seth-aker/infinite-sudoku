import 'package:flutter/cupertino.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/shared_page_layout.dart';
import 'package:infinite_sudoku/ui/user/widgets/reset_password_form.dart';

class ResetPasswordView extends StatelessWidget {
  final String token;
  const ResetPasswordView({required this.token, super.key});

  @override
  Widget build(BuildContext context) {
    return SharedPageLayout(
      title: "Reset Password",
      child: Column(
        mainAxisAlignment: .start,
        crossAxisAlignment: .center,
        children: [
          const Text(
            "Reset Password",
            style: TextStyle(fontSize: AppSpacing.four, fontWeight: .w600),
          ),
          const Text("Choose a new password"),
          ResetPasswordForm(token: token),
        ],
      ),
    );
  }
}
