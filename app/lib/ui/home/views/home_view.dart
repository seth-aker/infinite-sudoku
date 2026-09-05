import 'package:app/domain/models/difficulty.dart';
import 'package:app/routing/routes.dart';
import 'package:app/ui/core/app_theme.dart';
import 'package:app/ui/core/icons/app_icons.dart';
import 'package:app/ui/core/spacing/app_spacing.dart';
import 'package:app/ui/core/widgets/app_icon.dart';
import 'package:app/ui/core/widgets/button.dart';
import 'package:app/ui/core/widgets/shared_page_layout.dart';
import 'package:app/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:app/ui/user/state/user_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});
  @override
  Widget build(BuildContext context) {
    return SharedPageLayout(
      title: '',
      leading: CupertinoButton(
        child: const AppIcon(AppIcons.auth),
        onPressed: () {
          if (context.read<UserBloc>().state.status == .authenticated) {
            context.push(Routes.settings);
          } else {
            context.push(Routes.login);
          }
        },
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.two),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.half),
                child: Text(
                  'Sudoku',
                  style: TextStyle(
                    fontSize: AppSpacing.two,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary(),
                  ),
                ),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.foreground(context)),
                borderRadius: BorderRadius.all(Radius.circular(AppSpacing.one)),
              ),
              padding: EdgeInsets.all(AppSpacing.one),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                spacing: AppSpacing.half,
                children: DifficultyRating.values.map((rating) {
                  return SizedBox(
                    width: AppSpacing.twelve,
                    child: Button.primary(
                      onPressed: () {
                        context.read<PuzzleBloc>().add(
                          NewPuzzleFetched(difficultyRating: rating),
                        );
                        context.push(Routes.sudoku, extra: rating);
                      },
                      child: Text(rating.toString()),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
