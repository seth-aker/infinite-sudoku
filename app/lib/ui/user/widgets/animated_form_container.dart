import 'package:sudoku_app/ui/core/app_theme.dart';
import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:flutter/cupertino.dart';

class AnimatedFormContainer extends StatelessWidget {
  final Widget? child;
  final int animationDuration;
  const AnimatedFormContainer({
    required this.child,
    this.animationDuration = 250,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.one),
      child: Container(
        clipBehavior: Clip.hardEdge,
        decoration: BoxDecoration(
          border: BoxBorder.all(color: AppTheme.foreground(context)),
          borderRadius: const BorderRadius.all(
            Radius.circular(AppSpacing.one),
          ),
        ),
        width: double.infinity,
        child: AnimatedSize(
          duration: Duration(milliseconds: animationDuration),
          curve: Curves.easeInOut,
          alignment: Alignment.topCenter,
          child: child,
        ),
      ),
    );
  }
}
