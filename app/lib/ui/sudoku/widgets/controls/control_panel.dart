import 'package:infinite_sudoku/ui/core/icons/app_icons.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/app_icon.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/core/widgets/toggle_button.dart';
import 'package:infinite_sudoku/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ControlPanel extends StatelessWidget {
  const ControlPanel({super.key});
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PuzzleBloc, PuzzleState>(
      buildWhen: (previous, current) =>
          (current is PuzzlePlayingState && previous is PuzzlePlayingState) &&
          (previous.usingPencil != current.usingPencil),
      builder: (context, state) => Padding(
        padding: const EdgeInsets.all(8.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: AppSpacing.half,
          children: [
            SizedBox(
              height: AppSpacing.four,
              width: AppSpacing.four,
              child: Button.primary(
                onPressed: () =>
                    context.read<PuzzleBloc>().add(const UndoPressed()),
                child: AppIcon(AppIcons.undo),
              ),
            ),
            SizedBox(
              height: AppSpacing.four,
              width: AppSpacing.four,
              child: Button.primary(
                onPressed: () =>
                    context.read<PuzzleBloc>().add(const RedoPressed()),
                child: AppIcon(AppIcons.redo),
              ),
            ),
            SizedBox(
              height: AppSpacing.four - 2, // Adjust for the border width
              width: AppSpacing.four - 2,
              child: ToggleButton(
                onToggle: () =>
                    context.read<PuzzleBloc>().add(const PencilToggled()),
                isOn: state is PuzzlePlayingState ? state.usingPencil : false,
                child: AppIcon(AppIcons.pencil),
              ),
            ),
            // SizedBox(
            //   height: AppSpacing.four,
            //   width: AppSpacing.four,
            //   child: Button.primary(
            //     backgroundColor: AppTheme.destructive(),
            //     child: Icon(CupertinoIcons.trash),
            //     onPressed: () {
            //       final bloc = context.read<PuzzleBloc>();
            //       final state = bloc.state;
            //       if(state is PuzzlePlayingState) {
            //         final selectedIdx = state.selectedIdx;
            //         if(selectedIdx != null ) bloc.add(CellCleared(idx: selectedIdx));
            //       }
            //     }
            //   )
            // )
          ],
        ),
      ),
    );
  }
}
