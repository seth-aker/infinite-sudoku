import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:flutter/cupertino.dart';
import 'package:infinite_sudoku/ui/sudoku/state/puzzle/puzzle_bloc.dart';

class Numpad extends StatelessWidget {
  final void Function(int idx) onTap;

  const Numpad({super.key, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final controlsDisabled = context.select<PuzzleBloc, bool>(
      (bloc) => bloc.state.puzzle != null && bloc.state.puzzle!.isComplete,
    );
    return GridView.count(
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 3,
      mainAxisSpacing: AppSpacing.half,
      crossAxisSpacing: AppSpacing.half,
      children: List.generate(
        9,
        (index) => Button.primary(
          onPressed: controlsDisabled ? null : () => onTap(index + 1),
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
