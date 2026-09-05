import 'package:sudoku_app/ui/core/app_theme.dart';
import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:sudoku_app/ui/core/widgets/button.dart';
import 'package:flutter/cupertino.dart';

class ToggleButton extends StatelessWidget {
  final VoidCallback? onToggle;
  final bool isOn;
  final Widget child;
  final EdgeInsetsGeometry? padding;

  const ToggleButton({
    required this.onToggle,
    required this.isOn,
    required this.child,
    this.padding,
    super.key,
  });
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isOn ? AppTheme.primary() : AppTheme.background(context),
        border: BoxBorder.all(
          color: isOn ? AppTheme.primary() : AppTheme.foreground(context),
          width: AppSpacing.sixteenth,
        ),
        borderRadius: BorderRadius.all(Radius.circular(AppSpacing.half)),
      ),
      child: Button.icon(
        padding: padding,
        backgroundColor: isOn
            ? AppTheme.primary()
            : AppTheme.background(context),
        foregroundColor: isOn
            ? AppTheme.background(context)
            : AppTheme.buttonPrimary(context),
        onPressed: onToggle,
        child: child,
      ),
    );
  }
}
