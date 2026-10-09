import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:infinite_sudoku/ui/core/widgets/text_input.dart';

class FormTextInput extends StatelessWidget {
  final String label;
  final TextEditingController? controller;
  final String initialValue;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final bool obscureText;
  final String? placeholder;
  final void Function<T>(String? value)? onSaved;
  const FormTextInput({
    required this.label,
    this.controller,
    this.onSaved,
    this.initialValue = '',
    this.validator,
    this.onChanged,
    this.obscureText = false,
    this.placeholder,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      onSaved: onSaved,
      initialValue: initialValue,
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
          TextInput(
            controller: controller,
            errorText: field.errorText,
            onChanged: (value) {
              field.didChange(value);
              onChanged?.call(value);
            },
	    obscureText: obscureText,
	    placeholder: placeholder,
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
