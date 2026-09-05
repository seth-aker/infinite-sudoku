import 'package:sudoku_app/domain/models/user.dart';
import 'package:sudoku_app/routing/routes.dart';
import 'package:sudoku_app/ui/core/app_theme.dart';
import 'package:sudoku_app/ui/core/widgets/app_icon.dart';
import 'package:sudoku_app/ui/core/widgets/shared_page_layout.dart';
import 'package:sudoku_app/ui/user/state/preferences_cubit.dart';
import 'package:sudoku_app/ui/user/state/user_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class UserSettingsView extends StatefulWidget {
  const UserSettingsView({super.key});

  @override
  State<UserSettingsView> createState() => _UserSettingsViewState();
}

class _UserSettingsViewState extends State<UserSettingsView> {
  @override
  Widget build(BuildContext context) {
    final user = context.select<UserBloc, User?>(
      (userBloc) => userBloc.state.user,
    );
    return SharedPageLayout(
      title: "Settings",
      leading: CupertinoButton(
        padding: .zero,
        onPressed: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go(Routes.home);
          }
        },
        child: AppIcon(.back),
      ),
      trailing: const SizedBox.shrink(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (user != null)
            CupertinoFormSection(
              header: Text('User Details'),
              children: [
                CupertinoTextFormFieldRow(
                  prefix: const Text("Email"),
                  enabled: false,
                ),
                CupertinoTextFormFieldRow(
                  prefix: const Text("Username"),
                  enabled: false,
                ),
                GestureDetector(
                  behavior: .opaque,
                  onTap: () => showCupertinoDialog(
                    context: context,
                    builder: ((context) {
                      return CupertinoAlertDialog(
                        title: const Text("Request password reset email?"),
                        actions: [
                          CupertinoDialogAction(
                            isDestructiveAction: true,
                            child: const Text("No"),
                            onPressed: () => context.pop(),
                          ),
                          CupertinoDialogAction(
                            isDestructiveAction: true,
                            child: const Text("Yes"),
                            onPressed: () {
                              final userBloc = context.read<UserBloc>();
                              final state = userBloc.state;
                              if (state.status == .authenticated) {
                                userBloc.add(
                                  PasswordResetEmailRequested(
                                    email: state.user!.email,
                                  ),
                                );
                              }
                            },
                          ),
                        ],
                      );
                    }),
                  ),
                  child: CupertinoFormRow(
                    prefix: Expanded(child: const Text("Reset Password")),
                    child: AppIcon(.reset),
                  ),
                ),
              ],
            ),
          CupertinoFormSection(
            header: const Text("System Settings"),
            children: [
              CupertinoFormRow(
                prefix: const Text('Dark Mode?'),
                child: CupertinoSwitch(
                  value: context.select<PreferencesCubit, bool>(
                    (cubit) => cubit.state.isDarkMode,
                  ),
                  onChanged: ((value) => context
                      .read<PreferencesCubit>()
                      .setIsDarkMode(isDarkMode: value)),
                ),
              ),
              CupertinoFormRow(
                prefix: const Text('Start games in "Auto Candidate Mode"?'),
                child: CupertinoSwitch(
                  value: context.select<PreferencesCubit, bool>(
                    (cubit) => cubit.state.autoCandidateModeOn,
                  ),
                  onChanged: ((value) => context
                      .read<PreferencesCubit>()
                      .setAutoCandidateMode(
                        autoCandidateMode: value,
                      )),
                ),
              ),
            ],
          ),
          if (user != null)
            CupertinoFormSection(
              children: [
                GestureDetector(
                  behavior: .opaque,
                  onTap: () =>
                      context.read<UserBloc>().add(const LogoutRequested()),
                  child: CupertinoFormRow(
                    prefix: Expanded(child: Text('Logout')),
                    child: AppIcon(.logout, color: AppTheme.destructive()),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
