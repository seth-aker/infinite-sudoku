import 'package:sudoku_app/ui/core/constants.dart';
import 'package:sudoku_app/ui/core/icons/app_icons.dart';
import 'package:flutter/cupertino.dart';

class AppIcon extends StatelessWidget {
  final AppIcons icon;
  final double? size;
  final double? fill;
  final double? weight;
  final double? grade;
  final double? opticalSize;
  final Color? color;
  final List<Shadow>? shadows;
  final String? semanticLabel;
  final TextDirection? textDirection;
  final bool? applyTextScaling;
  final BlendMode? blendMode;
  final FontWeight? fontWeight;

  const AppIcon(
    this.icon, {
    super.key,
    this.size,
    this.fill,
    this.weight,
    this.grade,
    this.opticalSize,
    this.color,
    this.shadows,
    this.semanticLabel,
    this.textDirection,
    this.applyTextScaling,
    this.blendMode,
    this.fontWeight,
  });

  @override
  Widget build(BuildContext context) {
    if (isApple) {
      return Icon(cupertinoIconMap[icon]);
    } else {
      return Icon(materialIconMap[icon]);
    }
  }
}
