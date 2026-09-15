import 'package:flutter/cupertino.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/checkbox.dart';

class FormCheckbox extends StatefulWidget {
  final FormFieldValidator<bool>? validator;
  final bool initialValue;
  final Widget? leading;
  final Widget? trailing;
  final ValueChanged<bool?>? onChanged;
  final void Function<T>(bool? value)? onSaved;
  final bool disabled;
  const FormCheckbox({
    this.initialValue = false,
    this.validator,
    this.leading,
    this.trailing,
    this.onChanged,
    this.onSaved,
    this.disabled = false,
    super.key,
  });

  @override
  State<FormCheckbox> createState() => _FormCheckboxState();
}

class _FormCheckboxState extends State<FormCheckbox> {
  @override
  Widget build(BuildContext context) {
    return FormField<bool>(
      onSaved: widget.onSaved,
      initialValue: widget.initialValue,
      validator: widget.validator,
      builder: (field) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: field.value ?? false,
            leading: widget.leading,
            trailing: widget.trailing,
            onChanged: (value) {
              field.didChange(value);
              widget.onChanged?.call(value);
            },
	    hasError: field.hasError,
	    disabled: widget.disabled,
          ),
          if (field.hasError)
            Padding(
              padding: const .all(AppSpacing.quarter),
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
