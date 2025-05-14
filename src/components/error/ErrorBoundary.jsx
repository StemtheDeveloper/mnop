import React, { Component } from 'react';
import './ErrorBoundary.css';
// We'll use inline fallback since importing ErrorFallback was causing issues

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
        this.resetError = this.resetError.bind(this);
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can log the error to an error reporting service
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });

        // Optional: Send error to a logging service
        // logErrorToService(error, errorInfo);
    }

    resetError() {
        this.setState({ hasError: false });
    }

    render() {
        const { fallback } = this.props;

        if (this.state.hasError) {
            // You can render any custom fallback UI
            if (fallback) {
                return fallback(this.state.error);
            } return <ErrorFallback
                error={this.state.error}
                errorInfo={this.state.errorInfo}
                resetErrorBoundary={this.resetError}
            />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;