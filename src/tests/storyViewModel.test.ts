import { describe, expect, it } from 'vitest';
import { createStarterStory, type StoryDocument } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

// 构造一个顺序可控的 5 幕故事，其中 s1、s3、s5 的标题都含「回忆」，便于筛选出子集。
function createOrderedStory(): StoryDocument {
  const story = createStarterStory();
  story.scenes = [
    { id: 's1', title: '回忆之始', order: 1, summary: '回忆的开端', conflict: '', characterIds: [], clueIds: [] },
    { id: 's2', title: '现实之岸', order: 2, summary: '现实的彼岸', conflict: '', characterIds: [], clueIds: [] },
    { id: 's3', title: '回忆之深', order: 3, summary: '回忆的深处', conflict: '', characterIds: [], clueIds: [] },
    { id: 's4', title: '现实之核', order: 4, summary: '现实的核心', conflict: '', characterIds: [], clueIds: [] },
    { id: 's5', title: '回忆之终', order: 5, summary: '回忆的终章', conflict: '', characterIds: [], clueIds: [] },
  ];
  story.clues = [];
  story.selectedSceneId = 's3';
  return story;
}

function createViewModelWithStory(story: StoryDocument): StoryViewModel {
  const storage = new MemoryStorageService();
  storage.write(JSON.stringify(story));
  const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
  viewModel.initialize();
  return viewModel;
}

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

  it('numbers scenes by true position while searching and moves by visible neighbor', () => {
    const viewModel = createViewModelWithStory(createOrderedStory());

    // 完整顺序下编号连续：s1..s5 对应 1..5。
    expect(viewModel.getSceneNumber('s1')).toBe(1);
    expect(viewModel.getSceneNumber('s3')).toBe(3);
    expect(viewModel.getSceneNumber('s5')).toBe(5);

    // 搜索「回忆」只保留 s1、s3、s5，但编号仍是它们在完整故事中的真实位置 1、3、5。
    viewModel.setSearch('回忆');
    expect(viewModel.visibleScenes.map((scene) => scene.id)).toEqual(['s1', 's3', 's5']);
    expect(viewModel.getSceneNumber('s1')).toBe(1);
    expect(viewModel.getSceneNumber('s3')).toBe(3);
    expect(viewModel.getSceneNumber('s5')).toBe(5);

    // 在筛选视图中把 s3 下移：只与可见邻居 s5 交换，可见列表变成 s1、s5、s3。
    viewModel.moveScene('s3', 'down');
    expect(viewModel.visibleScenes.map((scene) => scene.id)).toEqual(['s1', 's5', 's3']);

    // 清空搜索后看到完整真实顺序 s1、s2、s5、s4、s3，编号仍连续且为真实位置。
    viewModel.setSearch('');
    expect(viewModel.snapshot.story?.scenes.map((scene) => scene.id)).toEqual(['s1', 's2', 's5', 's4', 's3']);
    expect(viewModel.getSceneNumber('s3')).toBe(5);
    expect(viewModel.getSceneNumber('s5')).toBe(3);
  });

  it('moves up by visible neighbor while searching', () => {
    const viewModel = createViewModelWithStory(createOrderedStory());
    viewModel.setSearch('回忆');
    expect(viewModel.visibleScenes.map((scene) => scene.id)).toEqual(['s1', 's3', 's5']);

    // s5 上移：与可见邻居 s3 交换，可见列表变成 s1、s5、s3。
    viewModel.moveScene('s5', 'up');
    expect(viewModel.visibleScenes.map((scene) => scene.id)).toEqual(['s1', 's5', 's3']);

    viewModel.setSearch('');
    expect(viewModel.snapshot.story?.scenes.map((scene) => scene.id)).toEqual(['s1', 's2', 's5', 's4', 's3']);
  });

  it('does not move a scene without a visible neighbor', () => {
    const viewModel = createViewModelWithStory(createOrderedStory());
    viewModel.setSearch('回忆');
    // s1 是第一个可见场景，上移无邻居；s5 是最后一个可见场景，下移无邻居。
    viewModel.moveScene('s1', 'up');
    viewModel.moveScene('s5', 'down');
    expect(viewModel.snapshot.story?.scenes.map((scene) => scene.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
  });

  it('moves by true order when no search is active', () => {
    const viewModel = createViewModelWithStory(createOrderedStory());
    // 无筛选时移动与完整顺序邻居交换，行为不变。
    viewModel.moveScene('s2', 'down');
    expect(viewModel.snapshot.story?.scenes.map((scene) => scene.id)).toEqual(['s1', 's3', 's2', 's4', 's5']);
  });
});
