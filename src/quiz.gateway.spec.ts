import { Test, TestingModule } from '@nestjs/testing';
import { QuizGateway } from './quiz.gateway';
import { Socket } from 'socket.io';

describe('QuizGateway', () => {
  let gateway: QuizGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuizGateway],
    }).compile();

    gateway = module.get<QuizGateway>(QuizGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should return the same data on handleMessage', () => {
    const data = 'Hello, Quiz!';
    const result = gateway.handleMessage(data);
    expect(result).toBe(data);
  });

  it('should emit connected event on handleConnection', () => {
    const emit = jest.fn();
    const client = { id: 'test-id', emit } as unknown as Socket;
    gateway.handleConnection(client);
    expect(emit).toHaveBeenCalledWith('connected', { message: 'Welcome to the Quiz Game!' });
  });

  it('should log on handleDisconnect', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const client = { id: 'test-id' } as unknown as Socket;
    gateway.handleDisconnect(client);
    expect(consoleSpy).toHaveBeenCalledWith('Client disconnected: test-id');
    consoleSpy.mockRestore();
  });
});
