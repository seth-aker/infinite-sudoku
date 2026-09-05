import 'dart:io';

import 'package:app/ui/sudoku_app.dart';
import 'package:app/data/repositories/auth_repository.dart';
import 'package:app/data/repositories/puzzle_repository.dart';
import 'package:app/data/service/api/api_client.dart';
import 'package:app/data/service/api/auth_service_remote.dart';
import 'package:app/data/service/api/puzzle_service_remote.dart';
import 'package:app/data/service/local_storage/token_storage_service.dart';
import 'package:app/utils/logger/logger.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hydrated_bloc/hydrated_bloc.dart';
import 'package:path_provider/path_provider.dart';

void main() async {
  logger.t("Starting Sudoku App");
  WidgetsFlutterBinding.ensureInitialized();
  final apiClient = ApiClient();
  final puzzleRepository = PuzzleRepository(
    puzzleService: PuzzleServiceRemote(client: apiClient),
  );
  final authRepository = AuthRepository(
    authService: AuthServiceRemote(client: apiClient),
    storageService: const TokenStorageService(
      storageClient: FlutterSecureStorage(),
    ),
  );
  apiClient.authHeaderProvider = () => authRepository.authHeader;

  Directory appData = await getApplicationDocumentsDirectory();
  logger.t("Hydrating blocs");
  HydratedBloc.storage = await HydratedStorage.build(
    storageDirectory: HydratedStorageDirectory(appData.path),
  );
  logger.t("Blocs hydrated successfully");
  runApp(
    SudokuApp(
      authRepository: authRepository,
      puzzleRepository: puzzleRepository,
    ),
  );
}
