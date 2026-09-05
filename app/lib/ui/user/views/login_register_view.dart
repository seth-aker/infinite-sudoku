import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:sudoku_app/ui/core/widgets/shared_page_layout.dart';
import 'package:sudoku_app/ui/user/widgets/animated_form_container.dart';
import 'package:sudoku_app/ui/user/widgets/login_form.dart';
import 'package:sudoku_app/ui/user/widgets/register_form.dart';
import 'package:flutter/cupertino.dart';
import 'package:go_router/go_router.dart';

enum VisisbleWidgetType { login, register }

class LoginRegisterView extends StatefulWidget {
  const LoginRegisterView({super.key});

  @override
  State<LoginRegisterView> createState() => _LoginRegisterViewState();
}

class _LoginRegisterViewState extends State<LoginRegisterView> {
  VisisbleWidgetType? _visibleWidgetType = VisisbleWidgetType.login;
  Widget _currentWidget = LoginForm();
  @override
  Widget build(BuildContext context) {
    return SharedPageLayout(
      leading: CupertinoNavigationBarBackButton(onPressed: () => context.pop()),
      trailing: const SizedBox.shrink(),
      title: _visibleWidgetType == VisisbleWidgetType.login
          ? "Login"
          : "Register",
      child: Padding(
        padding: const EdgeInsetsGeometry.directional(bottom: AppSpacing.one),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.one),
              child: CupertinoSlidingSegmentedControl<VisisbleWidgetType>(
                groupValue: _visibleWidgetType,
                onValueChanged: ((value) => setState(() {
                  _currentWidget = value == VisisbleWidgetType.login
                      ? LoginForm()
                      : RegisterForm();
                  _visibleWidgetType = value;
                })),
                children: {
                  VisisbleWidgetType.login: const Text('Login'),
                  VisisbleWidgetType.register: const Text('Register'),
                },
              ),
            ),
            AnimatedFormContainer(
              animationDuration: 250,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                switchInCurve: Curves.easeInOut,
                switchOutCurve: Curves.easeInOut,
                layoutBuilder: (currentChild, previousChildren) => Stack(
                  alignment: Alignment.topCenter,
                  clipBehavior: Clip.none,
                  children: [
                    // Positioned children don't contribute to a stack's size, this allows the 
		    // animatedsize's container to shrink immediately instead of waiting for the
		    // previousChildren to fully leave
                    for (final child in previousChildren)
                      Positioned(top: 0, left: 0, right: 0, child: child),
                    ?currentChild,
                  ],
                ),
                transitionBuilder: (Widget child, Animation<double> animation) {
                  final offsetAnimation = (child is LoginForm)
                      ? Tween<Offset>(
                          begin: const Offset(-1, 0),
                          end: Offset.zero,
                        )
                      : Tween<Offset>(
                          begin: const Offset(1, 0),
                          end: Offset.zero,
                        );
                  return SlideTransition(
                    position: offsetAnimation.animate(animation),
                    child: child,
                  );
                },
                child: _currentWidget,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
