import 'package:flutter/cupertino.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/app_icon.dart';

class Checkbox extends StatelessWidget {
  final bool value;
  final ValueChanged<bool?>? onChanged;
  final Widget? leading;
  final Widget? trailing;
  final bool disabled;
  final bool hasError;

  const Checkbox({
    required this.value,
    this.onChanged,
    this.leading,
    this.trailing,
    this.disabled = false,
    this.hasError = false,
    super.key,
  });

  void _onTap() {
    if (disabled) return;
    if (onChanged == null) return;
    onChanged!(!value);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      behavior: .opaque,
      child: Row(
        mainAxisSize: .min,
        children: [
          if (leading != null) ...[leading!, SizedBox(width: AppSpacing.half)],
          Container(
            decoration: BoxDecoration(
              border: .all(
                color: hasError
                    ? AppTheme.destructive()
                    : AppTheme.foreground(context),
                width: AppSpacing.sixteenth,
              ),
              color: value ? AppTheme.primary() : CupertinoColors.transparent,
              borderRadius: .all(.circular(AppSpacing.half)),
            ),
            child: SizedBox.square(
              dimension: AppSpacing.oneAndQuarter,
              child: value
                  ? AppIcon(
                      .check,
                      size: AppSpacing.one,
                      color: AppTheme.foreground(context),
                    )
                  : null,
            ),
          ),
          if (trailing != null) ...[
            SizedBox(width: AppSpacing.half),
            trailing!,
          ],
        ],
      ),
    );
  }
}
