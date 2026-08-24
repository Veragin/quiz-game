import styled, { css } from 'styled-components';

export type TButtonVariant = 'primary' | 'secondary' | 'danger' | 'gold' | 'goldSolid' | 'success';

export type TButtonSize = 'sm' | 'md';

type Props = {
    $variant?: TButtonVariant;
    $size?: TButtonSize;
    $fullWidth?: boolean;
};

const sizeStyles: Record<TButtonSize, ReturnType<typeof css>> = {
    sm: css`
        padding: 6px 14px;
        font-size: 12px;
    `,
    md: css`
        padding: 10px 20px;
        font-size: 14px;
    `,
};

const variantStyles: Record<TButtonVariant, ReturnType<typeof css>> = {
    primary: css`
        background: linear-gradient(135deg, var(--green), var(--green-dark));
        color: var(--text-primary);
        font-weight: 600;
        border: 1px solid rgba(212, 175, 55, 0.3);

        &:hover:not(:disabled) {
            background: linear-gradient(135deg, #588f4b, var(--green));
            box-shadow: 0 0 12px rgba(74, 124, 63, 0.35);
        }
    `,
    secondary: css`
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 1px solid var(--border);

        &:hover:not(:disabled) {
            background: var(--bg-hover);
            border-color: var(--text-secondary);
        }
    `,
    danger: css`
        background: transparent;
        color: var(--red-bright);
        border: 1px solid var(--red-dark);

        &:hover:not(:disabled) {
            background: rgba(163, 59, 42, 0.2);
        }
    `,
    gold: css`
        background: rgba(212, 175, 55, 0.15);
        color: var(--gold);
        font-weight: 600;
        border: 1px solid var(--gold-dim);

        &:hover:not(:disabled) {
            background: rgba(212, 175, 55, 0.25);
        }
    `,
    goldSolid: css`
        background: var(--gold);
        color: var(--bg-dark);
        font-weight: 700;
        border: none;

        &:hover:not(:disabled) {
            background: var(--gold-dim);
        }
    `,
    success: css`
        background: var(--green);
        color: #fff;
        font-weight: 600;
        border: 1px solid var(--green);

        &:hover:not(:disabled) {
            filter: brightness(1.1);
        }
    `,
};

export const Button = styled.button<Props>`
    border-radius: 8px;
    transition: all 0.2s;
    cursor: pointer;

    ${({ $size = 'md' }) => sizeStyles[$size]}
    ${({ $variant = 'secondary' }) => variantStyles[$variant]}
    ${({ $fullWidth }) =>
        $fullWidth &&
        css`
            width: 100%;
        `}

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;
