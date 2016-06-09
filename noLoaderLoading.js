import React from 'react';
import loading from 'react-avenger/loading';

class NoWrapper extends React.Component {
  render() {
    return this.props.children && this.props.children[0] || null;
  }
}

export default loading({
  wrapper: <NoWrapper />,
  loader: false
});
