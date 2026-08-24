import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useRoomService } from '../context/RoomContext';
import { useGameService } from '../context/GameContext';
import { Layout } from '../components/Layout/Layout';
import { Button } from '../components/Button';
import { Prepare } from '../components/Prepare/Prepare';
import { Answering } from '../components/Answering/Answering';
import { Guessing } from '../components/Guessing/Guessing';
import { Reveal } from '../components/Reveal/Reveal';
import { Scoreboard } from '../components/Scoreboard/Scoreboard';
import type { TGamePhase } from '../types';

export const RoomPage = observer(() => {
    const { isAuthenticated } = useAuth();
    const roomService = useRoomService();
    const gameService = useGameService();
    const { roomState } = roomService;
    const navigate = useNavigate();

    const [renaming, setRenaming] = useState(false);
    const [draftName, setDraftName] = useState('');

    useEffect(() => {
        if (!isAuthenticated) navigate('/login');
    }, [isAuthenticated, navigate]);

    const handleLeave = async () => {
        try {
            await roomService.leaveRoom();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not leave the room');
            return;
        }
        navigate('/rooms');
    };

    const startRenaming = () => {
        setDraftName(roomState?.name ?? '');
        setRenaming(true);
    };

    const handleRename = async (e: FormEvent) => {
        e.preventDefault();
        if (!draftName.trim()) return;
        try {
            await roomService.renameRoom(draftName.trim());
            setRenaming(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Could not rename the room');
        }
    };

    if (!roomState) {
        return (
            <Layout>
                <SLoading>Swimming to the room...</SLoading>
            </Layout>
        );
    }

    const header = (
        <SRoomBar>
            {renaming ? (
                <SRenameForm onSubmit={handleRename}>
                    <SRenameInput
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        maxLength={40}
                        autoFocus
                    />
                    <Button $variant="primary" $size="sm" type="submit" disabled={!draftName.trim()}>
                        Save
                    </Button>
                    <Button
                        $variant="secondary"
                        $size="sm"
                        type="button"
                        onClick={() => setRenaming(false)}
                    >
                        Cancel
                    </Button>
                </SRenameForm>
            ) : (
                <>
                    <SRoomName>{roomState.name}</SRoomName>
                    <Button $variant="secondary" $size="sm" onClick={startRenaming}>
                        Rename
                    </Button>
                </>
            )}
            <Button $variant="danger" $size="sm" onClick={handleLeave}>
                Leave
            </Button>
        </SRoomBar>
    );

    return (
        <Layout header={header} wide>
            {gameService.error && <SError>{gameService.error}</SError>}
            {renderPhase(gameService.phase)}
        </Layout>
    );
});

const renderPhase = (phase: TGamePhase | null) => {
    switch (phase) {
        case 'prepare':
            return <Prepare />;
        case 'answering':
            return <Answering />;
        case 'guessing':
            return <Guessing />;
        case 'reveal':
            return <Reveal />;
        case 'scoreboard':
            return <Scoreboard />;
        default:
            return <SLoading>Loading the game...</SLoading>;
    }
};

const SLoading = styled.p`
    color: var(--text-secondary);
    text-align: center;
    padding: 64px 24px;
`;

const SError = styled.p`
    color: var(--red-bright);
    text-align: center;
    margin-bottom: 16px;
`;

const SRoomBar = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
`;

const SRoomName = styled.span`
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
`;

const SRenameForm = styled.form`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const SRenameInput = styled.input`
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: var(--font-family);

    &:focus {
        border-color: var(--color-teal);
        outline: none;
    }
`;
