import 'package:sudoku_app/ui/core/app_theme.dart';
import 'package:sudoku_app/ui/core/constants.dart';
import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class FormTextInput extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final bool obscureText;
  const FormTextInput({
    required this.label,
    required this.controller,
    this.validator,
    this.onChanged,
    this.obscureText = false,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return (isApple)
        ? IosFormInputTextInput(
            label: label,
            controller: controller,
            validator: validator,
            onChanged: onChanged,
            key: key,
            obscureText: obscureText,
          )
        : MaterialFormTextInput(
            label: label,
            controller: controller,
            validator: validator,
            onChanged: onChanged,
            key: key,
            obscureText: obscureText,
          );
  }
}

class IosFormInputTextInput extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final bool obscureText;
  const IosFormInputTextInput({
    required this.label,
    required this.controller,
    this.onChanged,
    this.validator,
    this.obscureText = false,
    super.key,
  });
  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      initialValue: controller.text,
      validator: validator,
      builder: (field) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.quarter),
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: AppSpacing.one,
              ),
            ),
          ),
          CupertinoTextField(
            decoration: BoxDecoration(
              border: Border.all(
                color: field.hasError
                    ? AppTheme.destructive()
                    : CupertinoColors.inactiveGray,
              ),
              borderRadius: BorderRadiusGeometry.circular(5),
            ),
            controller: controller,
            onChanged: (value) => {
              field.didChange(value),
              onChanged?.call(value),
            },
            obscureText: obscureText,
          ),
          if (field.hasError)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.quarter),
              child: Text(
                field.errorText!,
                style: TextStyle(
                  color: AppTheme.destructive(),
                  fontSize: AppSpacing.threeQuarter,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class MaterialFormTextInput extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final bool obscureText;
  const MaterialFormTextInput({
    required this.label,
    required this.controller,
    this.onChanged,
    this.validator,
    this.obscureText = false,
    super.key,
  });
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label),
        TextFormField(
          validator: validator,
          controller: controller,
          onChanged: onChanged,
          obscureText: obscureText,
        ),
      ],
    );
  }
}
