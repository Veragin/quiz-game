import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import styled, { css } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useRoomService } from '../context/RoomContext';
import { Layout } from '../components/Layout/Layout';
import { Button } from '../components/Button';
import type { TGamePhase } from '../types';

const PHASE_LABELS: Record<TGamePhase, string> = {
    prepare: 'Waiting for players',
    answering: 'Answering',
    guessing: 'Guessing',
    reveal: 'Revealing',
    scoreboard: 'Finished',
};

export const RoomsPage = observer(() => {
    const { userId, name: userName, isAuthenticated, logout } = useAuth();
    const roomService = useRoomService();
    const { rooms, loading, error } = roomService;
    const [newRoomName, setNewRoomName] = useState('');
    const [creating, setCreating] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated) navigate('/login');
    }, [isAuthenticated, navigate]);

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;
        setCreating(true);
        try {
            const roomId = await roomService.createRoom(newRoomName.trim());
            setNewRoomName('');
            await roomService.joinRoom(roomId);
            navigate('/room');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not create the room');
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = async (roomId: string) => {
        try {
            await roomService.joinRoom(roomId);
            navigate('/room');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not join');
        }
    };

    const handleDelete = async (roomId: string) => {
        try {
            await roomService.deleteRoom(roomId);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not delete the room');
        }
    };

    return (
        <Layout
            header={
                <SHeaderBar>
                    <SUsername>🐟 {userName}</SUsername>
                    <Button $variant="secondary" $size="sm" onClick={logout}>
                        Log out
                    </Button>
                </SHeaderBar>
            }
        >
            <SCreateForm onSubmit={handleCreate}>
                <SCreateInput
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Name of a new room..."
                    maxLength={40}
                    disabled={creating}
                />
                <Button $variant="primary" type="submit" disabled={creating || !newRoomName.trim()}>
                    {creating ? 'Creating...' : 'Create room'}
                </Button>
            </SCreateForm>

            {error && <SError>{error}</SError>}
            {loading && <SMuted>Loading rooms...</SMuted>}

            <SRoomsList>
                {rooms.length === 0 && !loading && (
                    <SEmpty>No rooms yet. Be the first to dive in!</SEmpty>
                )}
                {rooms.map((room) => {
                    const isFull = room.playerCount >= room.maxPlayers;
                    const isSeated = room.players.some((p) => p.userId === userId);
                    // A closed room still lets its own players back in.
                    const canJoin = (room.isOpen && !isFull) || isSeated;

                    return (
                        <SRoomCard key={room.id}>
                            <SRoomCardHeader>
                                <SRoomName>{room.name}</SRoomName>
                                <SRoomMeta>
                                    <SPhaseTag $running={!room.isOpen}>
                                        {PHASE_LABELS[room.phase]}
                                    </SPhaseTag>
                                    <SRoomCount>
                                        👥 {room.playerCount}/{room.maxPlayers}
                                    </SRoomCount>
                                </SRoomMeta>
                            </SRoomCardHeader>
                            {room.players.length > 0 && (
                                <SPlayersList>
                                    {room.players.map((p) => (
                                        <SPlayerTag key={p.userId} $disconnected={p.isDisconnected}>
                                            {p.name}
                                        </SPlayerTag>
                                    ))}
                                </SPlayersList>
                            )}
                            <SRoomCardActions>
                                <Button
                                    $variant="primary"
                                    onClick={() => handleJoin(room.id)}
                                    disabled={!canJoin}
                                    title={
                                        !room.isOpen && !isSeated
                                            ? 'The game is already in progress'
                                            : undefined
                                    }
                                >
                                    {isSeated ? 'Back to the room' : 'Enter'}
                                </Button>
                                {room.playerCount === 0 && (
                                    <Button $variant="danger" onClick={() => handleDelete(room.id)}>
                                        Delete
                                    </Button>
                                )}
                            </SRoomCardActions>
                        </SRoomCard>
                    );
                })}
            </SRoomsList>
        </Layout>
    );
});

const SHeaderBar = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 8px;
`;

const SUsername = styled.span`
    color: var(--text-secondary);
    font-size: 14px;
`;

const SCreateForm = styled.form`
    display: flex;
    gap: 12px;
    margin-bottom: 24px;

    @media (max-width: 640px) {
        flex-direction: column;
    }
`;

const SCreateInput = styled.input`
    flex: 1;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: var(--font-family);

    &:focus {
        border-color: var(--color-teal);
        outline: none;
    }

    &::placeholder {
        color: var(--text-secondary);
    }
`;

const SError = styled.p`
    color: var(--red-bright);
    margin-bottom: 16px;
`;

const SMuted = styled.p`
    color: var(--text-secondary);
    text-align: center;
    padding: 24px;
`;

const SEmpty = styled(SMuted)`
    font-style: italic;
    padding: 48px 24px;
`;

const SRoomsList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const SRoomCard = styled.div`
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    box-shadow: var(--shadow-card);
    transition: all var(--transition-base);

    &:hover {
        border-color: rgba(0, 212, 170, 0.4);
        box-shadow: 0 0 15px rgba(0, 212, 170, 0.12);
    }
`;

const SRoomCardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 12px;
`;

const SRoomName = styled.h3`
    font-size: 18px;
    color: var(--text-primary);
    font-weight: 600;
`;

const SRoomMeta = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
`;

const SPhaseTag = styled.span<{ $running: boolean }>`
    padding: 2px 10px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    ${({ $running }) =>
        $running
            ? css`
                  background: rgba(251, 191, 36, 0.18);
                  color: var(--gold);
              `
            : css`
                  background: rgba(0, 212, 170, 0.15);
                  color: var(--color-teal);
              `}
`;

const SRoomCount = styled.span`
    font-size: 14px;
    color: var(--text-secondary);
`;

const SPlayersList = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
`;

const SPlayerTag = styled.span<{ $disconnected: boolean }>`
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 12px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    ${({ $disconnected }) =>
        $disconnected &&
        css`
            opacity: 0.5;
            font-style: italic;
        `}
`;

const SRoomCardActions = styled.div`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
`;
