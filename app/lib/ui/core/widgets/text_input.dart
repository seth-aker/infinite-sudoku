import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/constants.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/app_icon.dart';

class TextInput extends StatefulWidget {
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final bool obscureText;
  final String? placeholder;
  final String? errorText;
  final TextInputType? keyboardType;
  final bool autocorrect;
  final Iterable<String>? autofillHints;
  const TextInput({
    this.controller,
    this.onChanged,
    this.obscureText = false,
    this.placeholder,
    this.errorText,
    this.keyboardType,
    this.autocorrect = true,
    this.autofillHints,
    super.key,
  });

  @override
  State<TextInput> createState() => _TextInputState();
}

class _TextInputState extends State<TextInput> {
  late bool _textObscured;

  @override
  void initState() {
    _textObscured = widget.obscureText;
    super.initState();
  }

  void _onTapUp(TapUpDetails _) {
    setState(() {
      _textObscured = true;
    });
  }

  void _onTapDown(TapDownDetails _) {
    setState(() {
      _textObscured = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: .centerRight,
      children: [
        isApple
            ? CupertinoTextField(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: widget.errorText != null
                        ? AppTheme.destructive()
                        : CupertinoColors.inactiveGray,
                  ),
                  borderRadius: BorderRadiusGeometry.circular(5),
                ),
                controller: widget.controller,
                onChanged: widget.onChanged,
                obscureText: _textObscured,
                keyboardType: widget.keyboardType,
                autocorrect: widget.autocorrect,
                autofillHints: widget.autofillHints,
                placeholder: widget.placeholder,
                padding: .only(
                  top: AppSpacing.quarter,
                  left: AppSpacing.quarter,
                  bottom: AppSpacing.quarter,
                  right: AppSpacing.two,
                ),
              )
            : TextField(
                controller: widget.controller,
                obscureText: widget.obscureText,
                decoration: InputDecoration(
                  errorText: widget.errorText,
                  helperText: widget.placeholder,
                ),
                onChanged: widget.onChanged,
                keyboardType: widget.keyboardType,
                autocorrect: widget.autocorrect,
                autofillHints: widget.autofillHints,
              ),
        if (widget.obscureText)
          Positioned(
            child: _ObsureTextToggle(
              obscureText: _textObscured,
              onTapDown: _onTapDown,
              onTapUp: _onTapUp,
            ),
          ),
      ],
    );
  }
}

class _ObsureTextToggle extends StatelessWidget {
  final GestureTapDownCallback onTapDown;
  final GestureTapUpCallback onTapUp;
  final bool obscureText;

  const _ObsureTextToggle({
    required this.onTapDown,
    required this.onTapUp,
    required this.obscureText,
  });
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.half),
      child: GestureDetector(
        behavior: .opaque,
        onTapUp: onTapUp,
        onTapDown: onTapDown,
        child: AppIcon(obscureText ? .eyeClosed : .eyeOpen),
      ),
    );
  }
}
