import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/constants.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

sealed class Button extends StatelessWidget {
  const Button({super.key});

  factory Button.primary({
    required Widget child,
    required VoidCallback? onPressed,
    Color? backgroundColor,
    Color? foregroundColor,
    EdgeInsetsGeometry? padding,
    BorderRadius? borderRadius,
    bool? isDisabled
  }) => PrimaryButton(
    onPressed: onPressed,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
    padding: padding,
    borderRadius: borderRadius,
    isDisabled: isDisabled = false,
    child: child,
  );
  factory Button.ghost({
    required Widget child,
    required VoidCallback? onPressed,
    Color? backgroundColor,
    Color? foregroundColor,
    EdgeInsetsGeometry? padding,
    BorderRadius? borderRadius,
    bool? isDisabled
  }) => GhostButton(
    onPressed: onPressed,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
    padding: padding,
    borderRadius: borderRadius,
    isDisabled: isDisabled = false,
    child: child,
  );
  factory Button.secondary({
    required Widget child,
    required VoidCallback? onPressed,
    Color? backgroundColor,
    Color? foregroundColor,
    EdgeInsetsGeometry? padding,
    BorderRadius? borderRadius,
    bool? isDisabled
  }) => SecondaryButton(
    onPressed: onPressed,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
    padding: padding,
    borderRadius: borderRadius,
    isDisabled: isDisabled = false,
    child: child,
  );
  factory Button.icon({
    required Widget child,
    required VoidCallback? onPressed,
    Color? backgroundColor,
    Color? foregroundColor,
    EdgeInsetsGeometry? padding,
    BorderRadius? borderRadius,
    bool? isDisabled
  }) => IconButton(
    onPressed: onPressed,
    backgroundColor: backgroundColor,
    foregroundColor: foregroundColor,
    padding: padding,
    borderRadius: borderRadius,
    isDisabled: isDisabled = false,
    child: child,
  );
}

final class PrimaryButton extends Button {
  final Widget child;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;
  final bool isDisabled;
  const PrimaryButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.padding,
    this.borderRadius,
    this.isDisabled = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isApple) {
      return CupertinoButton(
        onPressed: isDisabled ? null : onPressed,
        padding: padding,
        color: backgroundColor ?? AppTheme.buttonPrimary(context),
        foregroundColor: foregroundColor ?? AppTheme.background(context),
        borderRadius: borderRadius,
        child: child,
      );
    } else {
      return ElevatedButton(onPressed: onPressed, child: child);
    }
  }
}

final class GhostButton extends Button {
  final Widget child;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;
  final bool isDisabled;
  const GhostButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.padding,
    this.borderRadius,
    this.isDisabled = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isApple) {
      return Container(
        decoration: BoxDecoration(
          border: Border.all(
            color: foregroundColor ?? AppTheme.foreground(context),
            width: AppSpacing.eighth,
          ),
          borderRadius: borderRadius,
          color: backgroundColor ?? Theme.of(context).scaffoldBackgroundColor,
        ),
        child: CupertinoButton(
          onPressed: isDisabled ? null : onPressed,
          padding: padding,
          color: CupertinoColors.transparent,
          foregroundColor: foregroundColor ?? AppTheme.foreground(context),
          borderRadius: borderRadius,
          child: child,
        ),
      );
    } else {
      return ElevatedButton(onPressed: onPressed, child: child);
    }
  }
}

final class SecondaryButton extends Button {
  final Widget child;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;
  final bool isDisabled;

  const SecondaryButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.padding,
    this.borderRadius,
    this.isDisabled = false,
  });
  @override
  Widget build(BuildContext context) {
    if (isApple) {
      return CupertinoButton(
        onPressed: isDisabled ? null : onPressed,
        color: backgroundColor ?? AppTheme.secondaryColor(context),
        foregroundColor: foregroundColor ?? AppTheme.textPrimary(context),
        padding: padding,
        borderRadius: borderRadius,
        child: child,
      );
    } else {
      return ElevatedButton(onPressed: onPressed, child: child);
    }
  }
}

final class IconButton extends Button {
  final Widget child;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;
  final bool isDisabled;
  const IconButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.padding,
    this.borderRadius,
    this.isDisabled = false,
  });
  @override
  Widget build(BuildContext context) {
    if (isApple) {
      return CupertinoButton(
        onPressed: isDisabled ? null : onPressed,
        color: backgroundColor ?? AppTheme.buttonPrimary(context),
        foregroundColor: foregroundColor ?? AppTheme.background(context),
        padding: padding ?? EdgeInsets.zero,
        borderRadius: borderRadius,
        child: child,
      );
    } else {
      return ElevatedButton(onPressed: onPressed, child: child);
    }
  }
}
