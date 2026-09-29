import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { orderedScenes } from '../models/storyRules';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('keeps scene numbers tied to the full order while moving within the filtered list', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    viewModel.addScene('第三个路口', '迷雾散开');
    viewModel.addScene('第四个路口', '潮汐退去');
    const firstScene = orderedScenes(viewModel.snapshot.story!)[0];
    const secondScene = orderedScenes(viewModel.snapshot.story!)[1];
    const thirdScene = orderedScenes(viewModel.snapshot.story!)[2];
    const fourthScene = orderedScenes(viewModel.snapshot.story!)[3];

    viewModel.setSearch('路口');
    expect(viewModel.visibleScenes.map((scene) => scene.id)).toEqual([thirdScene.id, fourthScene.id]);
    expect(viewModel.getSceneNumber(thirdScene.id)).toBe(3);
    expect(viewModel.getSceneNumber(fourthScene.id)).toBe(4);

    viewModel.setSearch('');
    expect(orderedScenes(viewModel.snapshot.story!).map((scene) => scene.id)).toEqual([
      firstScene.id,
      secondScene.id,
      thirdScene.id,
      fourthScene.id,
    ]);
    viewModel.setSearch('路口');

    viewModel.moveScene(thirdScene.id, 'down');
    expect(viewModel.getSceneNumber(thirdScene.id)).toBe(4);
    expect(viewModel.getSceneNumber(fourthScene.id)).toBe(3);
    expect(orderedScenes(viewModel.snapshot.story!).map((scene) => scene.id)).toEqual([
      firstScene.id,
      secondScene.id,
      fourthScene.id,
      thirdScene.id,
    ]);

    viewModel.setSearch('');
    expect(orderedScenes(viewModel.snapshot.story!).map((scene) => scene.order)).toEqual([1, 2, 3, 4]);
    expect(orderedScenes(viewModel.snapshot.story!).map((scene) => scene.id)).toEqual([
      firstScene.id,
      secondScene.id,
      fourthScene.id,
      thirdScene.id,
    ]);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });
});
