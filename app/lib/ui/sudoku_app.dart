import 'package:app/data/repositories/auth_repository.dart';
import 'package:app/routing/router.dart';
import 'package:app/ui/core/constants.dart';
import 'package:app/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:app/ui/core/app_theme.dart';
import 'package:app/data/repositories/puzzle_repository.dart';
import 'package:app/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:app/ui/user/state/preferences_cubit.dart';
import 'package:app/ui/user/state/user_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:toastification/toastification.dart';

class SudokuApp extends StatelessWidget {
  const SudokuApp({
    required this._puzzleRepository,
    required this._authRepository,
    super.key,
  });
  final AuthRepository _authRepository;
  final PuzzleRepository _puzzleRepository;
  @override
  Widget build(BuildContext context) {
    final PreferencesCubit preferencesCubit = PreferencesCubit();
    return MultiRepositoryProvider(
      providers: [RepositoryProvider.value(value: _puzzleRepository)],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
            create: (_) => PuzzleBloc(puzzleRepository: _puzzleRepository, preferencesCubit: preferencesCubit),
          ),
          BlocProvider(
            create: (_) => UserBloc(authRepository: _authRepository),
          ),
          BlocProvider(create: (_) => TimerBloc()),
          BlocProvider(create: (_) => preferencesCubit),
        ],
        child: const ToastificationWrapper(child: SudokuAppView()),
      ),
    );
  }
}

class SudokuAppView extends StatefulWidget {
  const SudokuAppView({super.key});
  @override
  State<StatefulWidget> createState() => _SudokuAppViewState();
}

class _SudokuAppViewState extends State<SudokuAppView> {
  late final GoRouter _router = router();
  @override
  Widget build(BuildContext context) {
    if (isApple) {
      return CupertinoApp.router(
        title: 'Sudoku App',
        theme: CupertinoThemeData(
          brightness: context.select<PreferencesCubit, Brightness>(
            (cubit) => cubit.state.isDarkMode ? .dark : .light,
          ),
          primaryColor: AppTheme.primary(),
          applyThemeToAll: true,
        ),
        routerConfig: _router,
      );
    }
    return MaterialApp.router(
      title: 'Sudoku App',
      theme: ThemeData(primaryColor: AppTheme.primary()),
      routerConfig: _router,
    );
  }
}
