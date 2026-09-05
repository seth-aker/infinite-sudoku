import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:sudoku_app/ui/core/widgets/button.dart';
import 'package:flutter/cupertino.dart';

class Numpad extends StatelessWidget {
  final void Function(int idx) onTap;

  const Numpad({super.key, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GridView.count(
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 3,
      mainAxisSpacing: AppSpacing.half,
      crossAxisSpacing: AppSpacing.half,
      children: List.generate(
        9,
        (index) => Button.primary(
          onPressed: () => onTap(index + 1),
          child: Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text('${index + 1}'),
            ),
          ),
        ),
      ),
    );
  }
}
