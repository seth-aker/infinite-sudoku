import 'package:sudoku_app/ui/core/colors/app_colors.dart';
import 'package:sudoku_app/ui/core/constants.dart';
import 'package:flutter/cupertino.dart';

class AppTheme {
  static bool get isIos => isApple;

  static bool isDarkMode(BuildContext context) {
    return CupertinoTheme.brightnessOf(context) == .dark; 
  }

  static Color primary() {
    return AppColors.primary;
  }

  static Color buttonPrimary(BuildContext context) {
    if (isDarkMode(context)) {
      return AppColors.white;
    } else {
      return AppColors.black;
    }
  }

  static Color background(BuildContext context) {
    if (isDarkMode(context)) {
      return AppColors.backgroundDark;
    } else {
      return AppColors.backgroundLight;
    }
  }

  static Color accent(BuildContext context) {
    if (isDarkMode(context)) {
      return AppColors.accentDark;
    } else {
      return AppColors.accentLight;
    }
  }

  static Color textPrimary(BuildContext context) {
    if (isDarkMode(context)) {
      return AppColors.foregroundDark;
    } else {
      return AppColors.foregroundLight;
    }
  }

  static Color foreground(BuildContext context) {
    if (isDarkMode(context)) {
      return AppColors.foregroundDark;
    } else {
      return AppColors.foregroundLight;
    }
  }

  static Color secondaryColor(BuildContext context) {
    if (isDarkMode(context)) {
      return AppColors.primary;
    } else {
      return AppColors.secondaryLight;
    }
  }

  static Color destructive() {
    return AppColors.destructive;
  }
}
